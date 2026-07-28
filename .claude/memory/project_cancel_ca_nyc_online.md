---
name: project_cancel_ca_nyc_online
description: Cancellation routing — online cancel only for CA + NYC (+ unknown ZIP); everyone else → Customer Support
metadata:
  type: project
---

Consumer subscription cancellation routing (owner 2026-07-28, **REVERSES the earlier HP-4** which wrongly forced CA→CS). `mustCancelViaCs(orders)` in `src/pages/member/AccountPage.js` — returns true = route to `/contact?topic=cancel` (Customer Support), false = online self-serve cancel.

**Rule (intent):** show ONLINE cancel if we can identify the user as living in **California** or **New York City**, or if we **can't determine location**. Everyone else (incl. NY State *outside* NYC — Buffalo, Westchester, Long Island) → Customer Support.

**Implemented via ZIP, because ZIP is the only location attribute we collect.** Our checkout sends `city` and `state` as **bogus** (`PaymentPage.js` bogusFields `city:true, state:true`; owner removed street/city capture 2026-07-03), so billing city/state are always empty — do NOT rely on them. ZIP is REQUIRED at checkout (`/^\d{5}$/`), read from `commerceToken.billingAddress.zip` via `getLatestBillingZip` (utils/orderFinancials.js). So:
- CA = ZIP `90001–96162` (or a real `state==CA` if an externally-created order carries one).
- NYC = 5-borough NON-contiguous ZIP set (`NYC_ZIP` helper): Manhattan 10001–10282, Staten Island 10301–10314, Bronx 10451–10475, Queens 11004/11005 + 11101–11109 + 11351–11499 + 11691–11697, Brooklyn 11201–11256. NY 105xx–109xx/115xx/14xxx are NOT NYC → CS.
- unknown = ZIP missing/invalid (rare).

Owner confirmed the ZIP rule set is correct. Conceptually extensible: if we later collect another attribute that identifies CA/NYC residency, add it as another `return false` branch. Legal driver: CA ARL / NYC online-cancel; noted the **federal FTC click-to-cancel** applies nationwide (routing 48 states to CS carries some exposure) — owner acknowledged.

⚠️ Consumer-app change — needs the build/ bundle uploaded to BC to go live.
