---
name: project_cancel_ca_nyc_online
description: Cancellation routing — ALL cancellations go through Customer Care (2026-09-01); no online self-serve cancel for anyone
metadata:
  type: project
---

**CURRENT RULE (owner 2026-09-01): every cancellation goes through Customer Care. There is no online
self-serve cancel for anyone, including California and NYC.** Clicking Cancel Subscription in
`src/pages/member/AccountPage.js` opens the reason + save-offer modal, then step 2 ("Continue to
Customer Care") hands off to `/contact?topic=cancel&reason=<label>`, which auto-opens the Customer Care
email modal with the topic and a pre-filled message. The client no longer calls
`api.cancelSubscription` to cancel — that method survives ONLY for **reactivate** (`flag:false`).

**⚠️ This was a deliberate, informed owner decision — do NOT "fix" it back.** I flagged that CA's ARL and
NYC's online-cancellation law require a self-serve online path for members who enrolled online, and that
removing it adds to the federal FTC click-to-cancel exposure already acknowledged for the other 48
states. The owner chose full-CSR routing anyway. A future session seeing the missing carve-out should
treat it as intentional, not a regression.

**History (superseded, kept so the reasoning isn't lost):**
- HP-4 originally forced CA → CS. **Wrong**, reversed 2026-07-28.
- 2026-07-28 – 2026-09-01: `mustCancelViaCs(orders)` gave ONLINE cancel to California, New York CITY, and
  unknown location; everyone else → CS. Implemented via **ZIP**, because ZIP is the only location
  attribute we collect — checkout sends `city`/`state` as **bogus** (`PaymentPage.js` bogusFields), so
  billing city/state are always empty. ZIP is required at checkout (`/^\d{5}$/`), read from
  `commerceToken.billingAddress.zip` via `getLatestBillingZip` (utils/orderFinancials.js).
  - CA = ZIP 90001–96162. NYC = 5-borough NON-contiguous set: Manhattan 10001–10282, Staten Island
    10301–10314, Bronx 10451–10475, Queens 11004/11005 + 11101–11109 + 11351–11499 + 11691–11697,
    Brooklyn 11201–11256. NY 105xx–109xx / 115xx / 14xxx are NOT NYC.
  - `mustCancelViaCs` + the `CA_ZIP`/`NYC_ZIP` helpers were **deleted** 2026-09-01 (they had no call
    sites left). Restore from git history + the ZIP sets above if the policy flips a fourth time.

**Analytics consequence:** `subscription_cancel` / `subscription_cancel_error` can no longer fire from
the consumer app — **`cancel_redirect_cs` is now the cancellation-intent signal** (carries `reason`,
`reasonText`, `orderId`, `via`). Actual cancellation completion now happens in CSR/BC and must be
reconciled there, not in GA4. `docs/EVENTS_CATALOG.md` updated. See [[project_tracking_architecture]].

⚠️ Consumer-app change — needs the `build/` bundle uploaded to BC to go live.
