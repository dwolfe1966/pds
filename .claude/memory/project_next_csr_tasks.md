---
name: queued-csr-tasks-after-shn-round-2026-06-03
description: Three CSR/admin work items the owner queued mid-SHN-framework to tackle next.
metadata: 
  node_type: memory
  type: project
  originSessionId: 2a7937d0-2c0b-462e-b57c-c5bc0b3fde3f
---

Owner queued these (2026-06-03) to do right after the current Shn-framework round:

1. **Review `messageCreate` in CSR** — BC said they may have **broken existing API calls**. Check `csrCreate*`/contactMessage/note create paths in `src/services/apiWrapper.js` against the current BC API; verify the CSR Notes/Messages + create flows still work (this is the area we already fixed once: [[project_bug_triage_status_2026_05_29]] Notes/Messages IIFE-first).
2. **All data exposed on CSR orders** — make sure the CSR order detail (`PurchaseDetailPage` / UserDetail Orders tab) surfaces *all* available order data fields, nothing dropped.
3. **Pass address if filled in** — signup/payment should send the billing **address** to BC when the user provided it (today billing ZIP is required; street/address may not be passed through). Check `PaymentPage` billing fields → BC `billing.sale`/`signup` body.

These are NOT started — queued behind the Shn framework work.
