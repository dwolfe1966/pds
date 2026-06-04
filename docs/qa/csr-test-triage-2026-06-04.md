# CSR Admin App — Test-Case Triage (2026-06-04)

**Source:** `docs/qa/XCally+CSR - CSR Test Cases.csv` (tested 6/3–6/4)
**Live CSR bundle (verified 6/4):** `admin.ce2e8005.js` + `admin.de3592b0.css` — this **is** current HEAD.

## ⚠️ Read this first — deploy skew

The 6/3 results were almost certainly captured against the **previous** live bundle
(`admin.844a2f72.js`), which had a different `UsersPage` column set (had "Last Bill",
lacked Zip/CC). HEAD `ce2e8005` reworked those columns and **only went live around
6/3–6/4**. So several 6/3 "fails" are likely **already resolved on what's live now** and
just need a re-test — they are NOT code bugs and NOT tester errors. Confirm the tester
re-runs against `ce2e8005` before we treat any column/field result as final.

Discriminators used: live bundle hash (`ce2e8005`), HEAD source in `src/pages/admin/`,
and BC API behavior.

---

## Bucket A — Likely already fixed by the `ce2e8005` deploy → **re-test on live**

No code change expected. Action = tester re-runs against current live bundle.

| Row | Test | 6/3 result | Why it should pass now |
|---|---|---|---|
| 20 | Display listing w Zipcode | N | HEAD `UsersPage` renders a **Zip** column (`u.zip`). |
| 23 | Display listing w Card | N (blk "1wk") | HEAD renders **CC** column (`····{last4cc}`). Data may still depend on BC populating `last4cc`. |
| 13 | Advanced Search by Email | N | Email server-search wired in HEAD; verify result set. |
| 16 | Advanced Search by Last 4 CC | N | Last4 server-search wired in HEAD. |
| 14 | Adv. Search by Phone *(note re: details phone)* | N | Phone **search** works; the note is about the *detail page* phone — see Bucket E. |
| 32 | Display Details Phone | N | HEAD detail page renders a **Phones** list from `user.phones`/`user.phone`. Likely empty-data, not missing UI — see Bucket E. |

---

## Bucket B — Genuinely unbuilt in HEAD → **scope / owner decision** (do not build net-new this close to launch without sign-off)

| Row | Feature | Rough effort | Notes |
|---|---|---|---|
| 61–64 | **Dashboard quick-search** (by ID / Email / Phone / Zip) | M | `MyDashboardPage` is a queue/triage landing — has **no** search. Net-new feature. |
| 24 | Listing **Phone** column | S | No phone column in `UsersPage` table/card. |
| 19 | Listing **Brand** column | S–M | No brand column; needs brandId→name mapping. |
| 18 | Advanced Search by **Brand** | S–M | Not in advanced panel (email/phone/zip/last4 only). |
| 17 | Advanced Search by **First 6 CC** | S | Not in advanced panel. |
| 15 | **Zip on the Detail page** | S | Genuinely absent in HEAD detail card. Source = latest order billing address. *(Smallest real ours-to-fix item.)* |
| 27 | Detail: Brand Contact Info | S | Not rendered. |
| 28 | Detail: **CC Update** | L | Editing card on file — large; BC billing flow. |
| 30 | Detail: Card details | S–M | `PurchaseDetailPage` shows BIN/last4; `UserDetailPage` does not surface card. |
| 35 | Detail: Status | S | Marked "1wk after launch." |
| 37 | Detail: **Customer Login** (login-as) | M–L | Impersonation flow — not built. |
| 52 | Cancel **Offer** Action | M | Tester "Maybe?" — not built. |
| 53 | **Add Offer** | M–L | Not built. |
| 54 | **Email Action & Templates** (CSR-composed) | L | Distinct from the consumer lifecycle emails added in `server/templates/email.js`. |
| 55 | **Billing Editor** | L | Not built. |
| 10 | XCally Trigger (CSR phone search/arg handling) | — | Telephony integration; likely BC/XCally side, not our SPA. |

---

## Bucket C — BC / environment, not our code

| Row | Test | Symptom | Read |
|---|---|---|---|
| 8 | Contact Us Billing Question | Captcha 412 "feature not available" | BC captcha gate. Do **not** suppress the captcha modal (see `feedback_never_block_bc_captcha_modal`). Tester noted "1wk after launch." Likely CSR-context captcha config/env. |
| 9 | Contact Us Start an email | Captcha 413 same | Same as above. |
| 42 | Transaction **Refund order** | BC `correct()` → `"notCorrectable"`, all-null payload, `rawResponse: undefined` | The `billingSeriesId` ends `:failed` — the **signup payment never succeeded**, so there's nothing to refund. Our `refundVoidOrder` call shape is correct (all 4 IDs populated). Confirm the target payment never reached `fulfilled`/sale; if so BC is behaving correctly. |
| 4 | Register Member | "Worked before, but not today" | Regression with no code change on our side near this date → BC backend / env / data. Needs a fresh repro + Network capture to attribute. |

---

## Bucket D — Real investigations (ours, but need live evidence)

| Row | Test | Why it's not a clean bucket |
|---|---|---|
| 38 | **Notes History** — "Saved Note, but do not see in Customer Profile" | We fixed + **verified** Notes on a bundle that should be live (`createNote` → 201; Notes/Messages verified 2026-06-01). So deploy-skew does NOT obviously explain this. Either it isn't actually deployed in `ce2e8005`, or BC changed the `findNotes` contract again. `handleSaveNote` refetches via `adminFindUserAdminNotes` after save — need the Network capture for `POST /message/admin/createNote` (201?) and the subsequent `GET /message/admin/findNotes` (does the new note appear?). |
| 39–41 | Transaction Sales / Collections / Refunds History | Tester marked "Y?" (uncertain). Verify against a known order with history. |

---

## Bucket E — Test-list items that may be data, not UI (verify before "fixing")

| Row | Test | Code reality | Likely cause |
|---|---|---|---|
| 1 | Register Member… | see Bucket C | — |
| 32 / 14 | Detail page **Phone** | HEAD renders a Phones list (`user.phones`/`user.phone`) | The test user likely has **no phone on file** → renders "—". Verify with a user known to have a phone before treating as a UI bug. |

---

## Bucket F — Owner decisions (semantics / scope)

1. **Unsubscribe → Opt-Out conflation (row 7).** Consumer Contact-Us "Unsubscribe from email / text" routes to `/opt-out` (intentional, commented). But *stop emails* ≠ *remove me from people-search*. A real unsubscribe path exists (`managedContact.unsubscribe` + admin `UnsubscribePage`). **Is the conflation acceptable for launch, or should "unsubscribe" hit a true email/SMS unsubscribe flow?** (Possible compliance/UX defect.)
2. **Cancel All vs per-order (row 51).** Detail page cancels a **single** order per row (`handleCancelOrder(oid, true)`). Tester flagged "Implemented as Cancel Order" + Blocker=Y. **Is per-order cancel sufficient, or is a "Cancel All Orders" action required?**
3. **New-feature launch scope (Bucket B).** Which of the unbuilt items are launch-blockers vs post-launch? Candidates most likely to matter: Dashboard quick-search, Phone/Brand listing columns, Zip on detail page.
4. **Listing "Last Bill" (row 25).** Tester saw Last Bill working (Y) on 6/3, but `ce2e8005` `UsersPage` has **no** Last Bill column (the rework replaced it with Zip+CC). Was Last Bill intentionally dropped, or should it return alongside Zip/CC? (Or is "Display listing" meant to be the Purchases/Orders list, not Users?)

---

## Passing (no action)

Rows 5 (Privacy), 6 (Remove My Info — redirect only), 12 (Filter by Name), 21 (listing Email),
22 (listing Name), 26 (listing Status), 29 (Customer ID), 31 (Email), 33 (IP), 34 (Device),
36 (Activity), 60 (Dashboard loads). Rows 56/57 (Opt Out / Unsubscribe pages) marked "?" — quick verify.

---

## Decisions & actions (owner, 2026-06-04)

- **Row 51 Cancel All → CLOSED as working-as-intended.** Per-order Cancel/Reactivate is the
  desired behavior; no "Cancel All" needed.
- **Row 7 Unsubscribe vs Opt-Out → DEFERRED (backlog).** Keep routing to `/opt-out` for now;
  revisit a true email/SMS unsubscribe (`managedContact.unsubscribe`) post-launch.
- **Bucket A → owner will confirm via live UAT** against `ce2e8005` before any code change.
- **Row 11 (confusing email-search hint) → ✅ SHIPPED.** Reworded `UsersPage` search hint to
  spell out which fields hit the server vs the client-side Name filter.
- **Row 15 (Zip on detail page) → ✅ SHIPPED (corrected).** Added a **Zip** row to the
  `UserDetailPage` profile card. **First attempt used `user.zip` — which is always undefined**
  (live UAT proved `zip` is absent from BOTH `/database/search` and `getUserDetail`). Corrected
  to source from the **order billing address** via new `getLatestBillingZip(orders)` in
  `orderFinancials.js` (`commercePayments[].commerceToken.billingAddress.zip`, then
  `commerceTokens[].billingAddress.zip`), mirroring how device/IP are derived. Unit-tested
  against the real BC order shape (zip `91362`). 5 new tests, suite green (24/24).

### ⚠️ New finding (NOT yet fixed) — listing Zip/CC columns are dead

The same UAT proved the **`/database/search` projection does not include `zip`, `last4cc`, or
`phone`** (doc keys are `_id, email, firstName, lastName, roles, brandId, sh*, …` only). So the
`ce2e8005` listing's **Zip and CC columns always render "—"** regardless of data — the column
rework added headers for fields BC never returns. Same root cause as the documented
`displayFields` trim. Options (owner call): (a) BC ask to add `zip`/`last4cc` to the user search
`displayFields`; or (b) drop the cosmetic columns. This reframes rows 20/23 from "fixed by
deploy" to **"column exists but never populates"** — the Bucket A re-test will still show "—".

*(Detail-page Zip + copy reword pending admin deploy: `admin.f80dd2d8.js`.)*

## Live UAT results (2026-06-04, Playwright vs real `dev.admin.www.bytecrtrs.com`, bundle `ce2e8005`)

Logged in as the CSR test account, read-only (search + view, no mutations).

**Confirmed PASS on live (Bucket A validated — these 6/3 fails were deploy skew):**
- **Listing columns** = `ID, Name, Email, Status, Tier, Zip, CC, Joined`. The **Zip (row 20)** and
  **CC (row 23)** column *headers* are present in `ce2e8005`. ⚠️ BUT they always render "—" — see
  "New finding" below: `/database/search` doesn't project `zip`/`last4cc`, so the columns are
  cosmetic. NOT a clean pass.
- **Email server search** → `POST /api/database/search` **201**, **10 result rows**. Row 13 ✓.
  The CSR DB search is **NOT** captcha-gated (unlike consumer people-search). Last-4 (row 16)
  rides the identical path → high confidence.
- **Detail page** renders a **Phones** section (row 32 ✓) — shows "—" for users with no phone
  (so the 6/3 fail was empty data, not missing UI). Confirmed via screenshot.
- **Detail page has NO Zip row on `ce2e8005`** → confirms the shipped fix (row 15) is real and
  not yet live; it appears once `admin.f5ca4ea7.js` deploys.

**No Phone column / No Brand column / No "Last Bill" column** on the live listing →
confirms rows 24/19 unbuilt and row 25's "Last Bill" was dropped in the column rework.

**Correction — Dashboard search (rows 61–64) is NOT unbuilt.** There is a **global nav search
box** (`AdminNav.js`, placeholder "ID, email, phone, or ZIP…") that routes to `/users?q=…`;
`UsersPage` parses `?q=` and runs a smart search on mount (classifies email/phone/zip/last4 →
server search). So:
- **Rows 62/63/64 (email/phone/zip)** ride the same `/database/search` path verified above →
  most likely PASS on live; need an **in-app (SPA-navigation) re-test** to close.
- **Row 61 (Search by ID)** is a **genuine small gap**: a 24-char ObjectId matches none of the
  email/phone/zip/last4 patterns, so it falls into the "Name search isn't supported yet" branch.
  Fix = detect an ObjectId and route to `/users/:id` (or `getUserDetail`). *(Not built; small.)*

**Env signal:** my cold-load `?q=` probes intermittently returned **403** on `/database/search`
(vs 201 on a warm in-app session). Likely a search-on-mount-vs-auth-init race on full reload,
but the intermittent 403 mirrors the tester's **row 4 "worked before, not today"** — worth
watching as BC dev-env instability.

## Recommended order

1. **Re-test Bucket A on live `ce2e8005`** (tester) — clears the most rows for zero code.
2. **Investigate Bucket D Notes (row 38)** with a Network capture — the one genuine "ours" defect that isn't deploy-skew.
3. **Ship two small ours-to-fix items** *(pending owner OK on scope)*: Zip on detail page (row 15) + reword the confusing email-search hint (row 11).
4. **Owner decisions** (Bucket F) gate everything in Bucket B.
5. **Bucket C** → file/repro with BC; not our code.
