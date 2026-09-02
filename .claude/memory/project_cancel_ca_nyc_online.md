---
name: project_cancel_ca_nyc_online
description: Cancellation routing — online cancel for CA + NYC only; everyone else (incl. unknown ZIP) → Customer Care
metadata:
  type: project
---

**CURRENT RULE (owner 2026-09-02).** `mustCancelViaCs(orders)` in `src/pages/member/AccountPage.js` —
returns **true = Customer Care**, **false = online cancel**.
- real `state === 'CA'` → **online** (rare; externally-created orders only)
- ZIP in **90001–96162** (California) → **online**
- ZIP in the **NYC 5-borough set** → **online**
- **ZIP missing/invalid → Customer Care** ⚠️ (see "fails closed" below)
- everything else, incl. NY State outside the boroughs → **Customer Care**

**NYC_ZIP set** (non-contiguous): Manhattan 10001–10282 · Staten Island 10301–10314 · Bronx 10451–10475 ·
Queens 11004/11005 + 11101–11109 + 11351–11499 + 11691–11697 · Brooklyn 11201–11256.
NY 105xx–109xx (Westchester/Hudson Valley), 115xx (Long Island), 14xxx (upstate) are **NOT** NYC.

**⚠️ ZIP-driven, never city/state.** Checkout sends `city`/`state` as **bogus** (`PaymentPage.js` bogusFields
city/state:true — owner removed street/city capture 2026-07-03), so those are always empty on our orders.
ZIP is required at checkout (`/^\d{5}$/`), read via `getLatestBillingZip` (utils/orderFinancials.js) from
`commerceToken.billingAddress.zip`.

**⚠️ CHANGED 2026-09-02 — unknown location now FAILS CLOSED.** The 2026-07-28 rule gave online cancel to
unknown-ZIP members (fail open); the owner chose Customer Care instead. Trade-off explicitly accepted: a
genuine CA/NYC resident whose ZIP didn't record loses the online path. Population is tiny (legacy /
externally-created orders only). **Do not "fix" this back without asking.**

**UI flow (2026-09-02):** the reason + save-offer modal opens for **every** member regardless of routing.
Step 2 then branches — CA/NYC cancel online in place; everyone else navigates to
`/contact?topic=cancel&reason=<label>`, which auto-opens the Customer Care modal with topic and message
pre-filled. This keeps churn-reason capture and the save attempt universal (before 2026-09-01, CS-routed
members skipped the modal entirely and their reasons were never captured).

**Legal driver:** California ARL + NYC online-cancellation law require a self-serve online path for members
who enrolled online. NY State has no equivalent — that is why the carve-out is the five boroughs, not the
state. Federal FTC click-to-cancel applies nationwide; residual exposure for the other 48 states is
owner-acknowledged.

**Policy history (all owner-directed):**
| Dates | Online cancel for | Everyone else |
|---|---|---|
| ~2026-05-26 → 07-21 | everyone | n/a |
| 07-22 → 07-27 | everyone except CA (then except CA **or** unknown ZIP) — **HP-4** | Customer Support |
| 07-28 (hours only) | CA + **NY state** + unknown | Customer Support |
| 07-28 → 08-31 | CA + **NYC** + unknown | Customer Support |
| **09-01 (one day)** | **nobody** — full-CSR (commit cea27ee) | Customer Care |
| **09-02 → now** | **CA + NYC only; unknown → CS** | Customer Care |

⚠️ These are **code** dates. Consumer changes only reach users when the `build/` bundle is uploaded to BC,
so user-facing dates lag and are not recorded here. Do not present this table as a record of what customers
actually experienced without confirming upload dates.

**Analytics:** `subscription_cancel` / `subscription_cancel_error` fire **only for CA/NYC** (online path);
`cancel_redirect_cs` fires for everyone else. **Total cancellation intent = the sum of all three** — neither
alone measures churn. `docs/EVENTS_CATALOG.md` updated. See [[project_tracking_architecture]].

`api.cancelSubscription(orderId, { flag: false })` remains the **reactivate** path and is unaffected.
