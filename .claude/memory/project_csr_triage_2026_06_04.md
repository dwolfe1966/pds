---
name: csr-triage-session-2026-06-04
description: "State after the XCally+CSR test-list triage: live/pending admin bundles, what's resolved vs open, and the BC asks + CTO-list assessment produced."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7aeba5ca-a8fd-4f98-b2f1-d4e52b390ce2
---

Triaged `docs/qa/XCally+CSR - CSR Test Cases.csv`. Full report:
`docs/qa/csr-test-triage-2026-06-04.md` (buckets A–F + live UAT results).

**Bundles:**
- **Live admin = `admin.eac6104b.js`** (owner deployed 6/4; supersedes `ce2e8005`). Consumer
  `df6359be` also deployed 6/4 (makes the Q4 street-address-when-filled true live).
- **(superseded) `admin.ce2e8005.js`** was live earlier 6/4 — was `844a2f72`; the 6/3 tester
  was on `844a2f72`, which explains most column "fails" = deploy skew.
- **`admin.eac6104b.js`** (now live) adds: ZIP on CSR detail page
  (sourced from order billing address, NOT user.zip — see [[bc-csr-user-object-omits-zip-card-phone]])
  + reworded Users search hint + Notes error-state hardening (see below). Built from HEAD;
  deploy via FileZilla.

**Notes (row 38) — NOT deploy skew (corrected):** `844a2f72` (live 6/2, the 6/3 tester's bundle)
ALREADY had the Notes/Messages fix, so skew can't explain it. Warm session works end-to-end
(createNote 201 → findNotes 200 → renders after save+reload), BUT a cold-load run returned
`GET /message/admin/findNotes → 403`; `fetchNotes` uses `allSettled` so a 403 → empty notes →
silent "No notes" = "saved a note, don't see it". **Client fix shipped (eac6104b):** `notesError`
flag → empty state shows "Couldn't load notes — Retry" instead of false empty. Root cause
(intermittent CSR 403 on cold load) is BC-side, shared with row 4; filed in BC_CSR_DATA_EXPOSURE.
- Email server search + detail Phones section render on live; CSR `/database/search` is **not**
  captcha-gated (unlike consumer people-search).

**Owner decisions (6/4):** Cancel = per-order (row 51 closed) · Unsubscribe→/opt-out = backlog ·
ship ZIP-on-detail + copy fix (done) · Bucket A = verify via UAT (done).

**Open:** deploy f80dd2d8 + re-test Bucket A; **listing Zip/CC columns are dead** (BC search
omits those fields — BC ask filed); Bucket B feature scope (Dashboard ID-search row 61 is a real
small gap; 62–64 ride the working nav search); intermittent **403 on CSR `/database/search`**
(cold-load/auth race; mirrors row-4 "worked before, not today").

**BC asks + assessment produced:**
- `docs/BC_CSR_DATA_EXPOSURE.md` — add zip/last4cc/phone to CSR user-search displayFields;
  FYI `contactMessage/admin/find/:userId` 404s.
- `docs/qa/cto-communication-assessment-2026-06-04.md` — review of the QA→BC-CTO attribution
  list. Key: reframe **Q4 (street)** — our frontend already sends real street with
  `bogusFields.street1=false` (commit 9ac6145, in undeployed consumer `df6359be`); ask is BC
  *persistence*. Resolve **Q2 contradiction** — CTO note says `commerceorders.refer` persists,
  our `trackingService.js:34` says it doesn't (which is why attribution rides `data.refer` in the
  tracking store). None of the CTO items are launch-blockers; ship Shn thin-bridge, treat the
  full attribution-tree (old weinform-style modeling) as fast-follow. See [[shn-partner-attribution-framework]].
