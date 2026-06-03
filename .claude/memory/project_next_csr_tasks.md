---
name: queued-csr-tasks-after-shn-round-2026-06-03
description: Three CSR/admin work items the owner queued mid-SHN-framework to tackle next.
metadata: 
  node_type: memory
  type: project
  originSessionId: 2a7937d0-2c0b-462e-b57c-c5bc0b3fde3f
---

Owner queued these (2026-06-03) to do right after the current Shn-framework round:

1. ✅ **DONE (commit f378e75)** — Review `messageCreate` in CSR. Active paths already migrated to BC's 2026-04-17 API and work (note-create POST /message/admin/createNote → 201 verified live; contact forms use submitContact → message.contact.create). Removed dead `userCreateContact`/`createUserContact`/legacy `createContact` referencing BC-removed endpoints.
2. ✅ **DONE (commit 46c00ac, admin bundle 1ed4c308)** — All data exposed on CSR orders. `PurchaseDetailPage` now shows attribution (shConId/shColId), offer, payer/payee, brand, status reason, order IP, retries; per-payment gateway txn/device/IP; + raw "All order fields" JSON viewer. Verified live.
3. **Pass address if filled in** ← **IN PROGRESS** — signup/payment should send the billing **address** (street) to BC when provided (today only billing ZIP is required/passed). Check `PaymentPage` billing fields → BC `billing.sale`/`signup` body.

Bonus finding (not fixed): the **admin header logo is broken** ("[broken img] IDLookup.AI Admin") — admin-side equivalent of the #67 consumer logo bug; the data-URI fix was consumer-only.
